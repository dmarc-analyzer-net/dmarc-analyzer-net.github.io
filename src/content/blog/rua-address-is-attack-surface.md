---
title: Your rua= address is a published attack surface
seoTitle: DMARC report addresses are attack surface
description: My DMARC analyzer would unpack anything mailed to an address I'd published in DNS. How one email could have stopped it, and the bug inside the fix.
type: engineering
publishDate: 2026-10-15
---

The question that started this was a boring one. I was in a Claude Code session,
working through the ingestion code of DMARC Analyzer, and I asked what happens
to a report attachment between the mailbox and the parser.

The answer came back in about four lines. The attachment is read into memory.
If it's a zip, every entry is decompressed into a `MemoryStream`. If it's gzip,
the same. Then it goes to the parser.

I read it twice, and then asked the follow-up that should have been asked
months earlier: *how big is it allowed to get?*

It wasn't. There was no byte cap, no entry cap and no ratio check. The only
limit anywhere in that method was a timer on the loop, which does nothing to
stop one attachment eating memory until the process falls over. And that code
had been there, more or less unchanged, since the first ingestion pipeline in
April.

## Who can send me an attachment?

Here's the part that made my stomach drop a little. Look at any DMARC record
with reporting turned on:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com
```

That `rua=` tag is a public instruction to the entire internet: *send your
reports here.* That's the whole point of it. Mailbox providers do exactly that,
usually once a day, as compressed XML attached to an email. And then something
like my analyzer opens every one of those attachments automatically, with no
human in the loop.

Most decompression bugs hide behind some friction. You have to find the upload
form, or get an account, or guess an API. Mine had none:

- **The address is published in DNS.** Nobody has to discover it. One lookup
  and you know where to send a payload, and you know it will be opened.
- **The sender picks the file names.** I only looked at entries ending in
  `.xml` or `.json`. That filter was there to skip junk from real reporters. It
  was never a defence, because whoever builds the archive chooses the names.
- **One email stops everything.** DMARC Analyzer runs exactly one ingestion
  worker per database, behind a lock, so two workers never fight over the same
  mailbox. That's correct. It also means that if one attachment exhausts that
  worker, report ingestion stops for every client on the instance. For an
  agency monitoring forty client domains on one install, that's all forty, gone
  quiet, from one message.

I did the arithmetic to see how bad it was. 64 MB of zeroes gzips to 65,150
bytes, roughly 1,000 to 1. So an email of a megabyte or two could ask my worker
for more than a gigabyte, and my code would have cheerfully tried to give it
one.

## Three limits, and one I refused

The fix itself was not complicated. We settled on three absolute limits:

| Setting | Default | What it stops |
|---|---|---|
| `Worker__MaxReportEntryBytes` | 64 MB | One small entry that expands without end: the classic bomb |
| `Worker__MaxReportAttachmentBytes` | 128 MB | Lots of entries, each one individually under the per-entry cap |
| `Worker__MaxReportArchiveEntries` | 512 | An archive of millions of tiny members |

All three sit far above any real aggregate report. They exist to stop an
attack, not to police size.

The one I refused was a compression ratio, the "refuse anything that expands
more than 100×" rule. It was suggested to me, and on paper it's the elegant
answer. But a ratio needs to know the compressed size of each entry, and the
formats I receive don't reliably say. The archive can simply lie about itself.
A ratio check that quietly doesn't apply on some code paths is worse than no
ratio check at all, because it lets you believe you're protected. Plain byte
counts are boring, and they work everywhere.

The per-attachment cap looked redundant at first: if every entry is under
64 MB, why cap the total? Because my ingestion loop extracts every payload in an
attachment before it parses any of them, so they're all in memory at once. A
thousand entries just under the cap is the same attack as one giant entry, with
more steps.

And the reading had to stop *while* reading. The tidy way to write this is to
copy the stream out and then check how much came out, but by then the memory is
allocated and the bomb has gone off. The new code reads 80 KB at a time, counts
as it goes, and throws the moment it crosses a line.

## The bug hiding inside the fix

This is the bit I actually wanted to write about.

We didn't describe bombs in comments; we built them in the test suite. 64 MB of
zeroes, gzipped. The same thing inside a zip, hiding behind one perfectly
legitimate report. A pile of entries that are each fine on their own and only
fail on the total. Each test checks not just that the bomb was refused, but
*which* limit refused it.

The first test run went red.

The gzip path did exactly what it should: it hit the limit and threw. The zip
path hit the same limit, caught its own exception, and returned an empty list.
So a refused zip bomb looked, to everything downstream, like an attachment that
simply had nothing in it. It never reached the parse-failure counter. It never
showed up in the sync run's statistics, which is the one place anyone running
the instance would ever look.

The attack would have failed, and nobody would ever have known it happened.

Neither Claude nor I had seen that by reading the code. I'd reviewed it; it
looked fine. The test caught it because it asked a slightly meaner question
than I had. Not "was the bomb stopped?" but "can anyone tell it was stopped?"
I've thought about that distinction a lot since. A defence that leaves no
evidence is only half a defence.

Both paths throw now. A refusal counts as a parse failure, and the log line
names the limit and its value, so whoever reads it knows immediately whether to
raise the limit or go and look at what landed in the mailbox. And if an archive
trips a byte limit, the whole thing is thrown away, including anything already
pulled out of it. An archive that tried that is not one I want partial results
from.

## Same limit, different answer

A few days later DMARC Analyzer grew a second front door: an HTTP endpoint for
reports pushed by another system. Same extractor, same limits, and a small
argument with myself about one of them.

When a mailbox delivers an archive with more than 512 entries, I skip the rest
and log a warning. Email can't be re-sent on request, so keeping what fits
beats throwing it all away. But when the same archive arrives over HTTP, I
refuse the whole thing with a `413` that names the setting. That caller *can*
split it and try again, and a cheerful `200` saying "5 inserted" for a
twenty-entry archive would be a lie that looks exactly like success.

Same limit. Different caller. Different right answer.

## What I still haven't bounded

The compressed email itself. By the time any of this runs, the whole message
has already been fetched. The real ceiling there is the maximum message size of
whatever mail server receives the reports, and that's outside my application.
I'd rather say that out loud than pretend the whole path is sealed.

## If you read a reporting mailbox too

None of this is special to my code. If anything you run opens DMARC or TLS-RPT
reports, whether a script, a SIEM connector or someone else's analyzer, it's
worth five minutes to ask:

- Is decompression limited **while it reads**, per entry and per attachment?
- Is the number of archive entries capped before any filtering by name?
- When an attachment is refused, does anyone ever find out?
- If ingestion stalls, does it stall for one mailbox, or for everything?

And if, like me, you write most of your code with an AI assistant, here's the
honest takeaway. It wrote code that handled every real report I'd ever seen. I
reviewed that code and agreed. Neither of us asked what a hostile sender would
do until something made us. That question doesn't come for free from either
side of the conversation. You have to ask it on purpose, of every input that
arrives from the internet.

If you're running DMARC Analyzer older than v0.11.0, please upgrade. The three
settings are in the
[configuration reference](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/docs/ops/configuration.md),
and the full change is
[pull request #165](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/pull/165).
If you're new to all this and wondering what actually lands at a `rua=`
address, start with
[what a DMARC aggregate report is](/glossary/dmarc-aggregate-report/).
