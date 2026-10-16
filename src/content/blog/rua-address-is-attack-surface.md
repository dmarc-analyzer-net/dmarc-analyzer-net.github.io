---
title: Your rua= address is a published attack surface
seoTitle: DMARC report addresses are attack surface
description: My DMARC analyzer would unpack anything mailed to an address I'd published in DNS. How one email could have stopped it, and the bug inside the fix.
type: engineering
publishDate: 2026-10-15
---

The question that started this was a boring one. It was an evening session (most
of my sessions are). I was in Claude Code, working through the ingestion code, 
and I asked what flow a report attachment have from the mailbox, to the parser
and into the db.

The answer came back more or less as espected. The attachment is read into 
memory. Every entry is decompressed into a `MemoryStream`, if it is compressed, 
and then it goes to the parser.

I then got the thinking of decompression and security, and asked: *how big is 
it allowed to get? What limits are there?* This can go 2 ways - noboddy thought
about security or somebody did and now we have no limits or too little limits.

There was none. There was no byte cap, no entry cap and no ratio check. The only
limit anywhere in that method was a timer on the loop, which does nothing to
stop one attachment eating memory until the process falls over. And that code
had been there, more or less unchanged, since the first ingestion pipeline in
April. So the no limit saved me from problems early, but no limits also seemed
a bit too optimistic.

## Who can send me an attachment?

The detail that could make this a problem. Look at any DMARC record with 
reporting turned on:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com
```

That `rua=` tag is a public instruction to the entire internet: *send your
reports here.* That's the whole point of it. ESP's do exactly that once a day, 
as compressed XML attached to an email. And then something like this dmarc 
analyzer opens every one of those attachments automatically.

Most decompression bugs hide behind some friction. You have to find the upload
form, or get an account, or guess an API. Here you just put the email out to 
everyone:

- **The address is published in DNS.** Nobody has to discover it. One lookup
  and you know where to send a payload, and you know it will be opened.
- **One email stops everything.** DMARC Analyzer runs exactly one ingestion
  worker per database, behind a lock, so two workers never fight over the same
  mailbox. That's correct. It also means that if one attachment exhausts that
  worker, report ingestion stops for every client on the instance. For an
  agency monitoring forty client domains on one install, that's all forty, gone
  quiet, from one message. Some try catch could help here, but not much if the
  process crashes...

I asked Claude to test a bit - to see how bad it could get. 64 MB of zeroes gzips
to 65,150 bytes, roughly 1,000 to 1. So an email of a megabyte or two could ask 
my worker for more than a gigabyte, and my code would happily have tried to read 
it all.

## Three limits, and one I refused

The fix itself was not complicated. We settled on three absolute limits:

| Setting | Default | What it stops |
|---|---|---|
| `Worker__MaxReportEntryBytes` | 64 MB | One small entry that expands without end: the classic bomb |
| `Worker__MaxReportAttachmentBytes` | 128 MB | Lots of entries, each one individually under the per-entry cap |
| `Worker__MaxReportArchiveEntries` | 512 | An archive of millions of tiny members |

All three sit far above any real aggregate report. They exist to stop an
attack (or just bad code from the ESP), not to police size.

The one I refused was a compression ratio, the "refuse anything that expands
more than 100×" rule. Claude suggested it, and it could seem elegant. 
But a ratio needs to know the compressed size of each entry, and the
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

I asked Claude to build real bombs in the test suite instead of just describing
them in comments. 64 MB of zeroes, gzipped. The same thing inside a zip, hidden
behind one normal report. And a pile of entries that are each fine on their own
and only fail on the total. Each test checks that the bomb was refused, and
also *which* limit refused it.

The first test run went red.

The gzip path did what it should: hit the limit and threw. The zip path hit the
same limit, caught its own exception and returned an empty list. So a refused
zip bomb looked like an attachment with nothing in it. It never reached the
parse-failure counter and never showed up in the sync run's statistics, which
is the only place you would look as the one running the instance.

So the attack would fail, and nobody would know it had happened.

Neither Claude nor I had seen that by reading the code. I had reviewed it and it
looked fine. The test caught it because it asked a slightly stricter question:
not "was the bomb stopped?" but "can anyone see that it was stopped?" A defence
that leaves no trace is only half a defence.

Both paths throw now. A refusal counts as a parse failure, and the log line
names the limit and its value, so you can tell straight away whether to raise
the limit or go look at what landed in the mailbox. If an archive trips a byte
limit, the whole attachment is thrown away, including anything already pulled
out of it. I don't want partial results from an archive that tried that.

## Same limit, different answer

A few days later DMARC Analyzer got a second way in: an HTTP endpoint where
another system can push reports. Same extractor, same limits, but one of them
behaves differently there, on purpose.

When a mailbox delivers an archive with more than 512 entries, the rest are
skipped and a warning is logged. You can't ask for an email to be sent again,
so keeping what fits is better than throwing it all away. Over HTTP the same
archive is refused with a `413` that names the setting. That caller *can* split
it and try again, and a `200` saying "5 inserted" for a twenty-entry archive
would look exactly like success while being wrong.

Same limit, different caller, different right answer.

## What still isn't bounded

The compressed email itself. By the time any of this runs, the whole message
has been fetched. The real ceiling there is the maximum message size on the
mail server that receives the reports, and that's outside the application. I'd
rather say that than pretend the whole path is closed.

## If you read a reporting mailbox too

None of this is special to my code. If something you run opens DMARC or TLS-RPT
reports (a script, a SIEM connector, another analyzer), it's worth five minutes
to check:

- Is decompression limited **while it reads**, per entry and per attachment?
- Is the number of archive entries capped before any filtering by name? Whoever
  builds the archive picks the names, so a `.xml` filter is not a defence.
- When an attachment is refused, does anyone ever find out?
- If ingestion stalls, does it stall for one mailbox or for everything?

And if you write most of your code with an AI assistant like I do: Claude wrote
code that handled every real report I had seen, and I reviewed it and agreed.
Neither of us asked what a hostile sender would do until I asked about limits.
That question doesn't come by itself from either side. You have to ask it on
purpose, for anything that arrives from the internet.

If you run DMARC Analyzer older than v0.11.0, please upgrade. The three settings
are in the
[configuration reference](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/docs/ops/configuration.md),
and the full change is
[pull request #165](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/pull/165).
If you're new to this and wonder what actually lands at a `rua=` address, start
with [what a DMARC aggregate report is](/glossary/dmarc-aggregate-report/).
