---
title: Your rua= address is a published attack surface
seoTitle: DMARC report addresses are attack surface
description: A DMARC record tells strangers where to mail attachments you will decompress automatically. How we bounded that, and what the tests caught.
type: engineering
publishDate: 2026-10-15
---

Every DMARC record with a reporting address contains an instruction to the
whole internet:

```
v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com
```

`rua=` says: send your aggregate reports here. Mailbox providers do exactly
that, usually once a day, as compressed XML attached to an email. Whatever reads
that mailbox then unpacks every attachment it finds, automatically, with nobody
looking.

Until v0.11.0 (August 2026), DMARC Analyzer unpacked them with no limit of any
kind. This post is about how we found that, what we did about it, and the parts
that generalise to anything else that reads a reporting mailbox.

## Why this is worse than the usual decompression bug

Unbounded decompression is a well-known class of bug. Most instances of it sit
behind some form of discovery: an upload form you have to find, an API you have
to authenticate to. A DMARC report processor has three properties that remove
the usual friction.

**The address is published in DNS.** That's not a leak; it's the point of the
`rua=` tag. Anyone who can run a DNS lookup knows where to send a payload, and
that the payload will be opened.

**The sender controls the file names.** We only looked at archive entries ending
in `.xml` or `.json`. That filter exists to skip junk from real reporters. It
was never a control, because the person building the archive chooses the names.

**The blast radius was the whole instance.** DMARC Analyzer runs exactly one
ingestion worker per database, enforced by a lock, so that two workers never
race on the same mailbox. That's the right design for correctness. It also
meant that one attachment big enough to exhaust the worker stopped report
ingestion for every client on the instance, not just the domain whose mailbox
received it.

How small can such an attachment be? 64 MB of zeroes gzips to 65,150 bytes, a
ratio of about 1,000 to 1. A mail message of a megabyte or two could therefore
ask the worker for more than a gigabyte. Our code would
have tried to provide them, into a `MemoryStream`, with no ceiling.

## The fix: three absolute limits

| Setting | Default | What it stops |
|---|---|---|
| `Worker__MaxReportEntryBytes` | 64 MB | One small entry expanding without end: the classic bomb |
| `Worker__MaxReportAttachmentBytes` | 128 MB | Many entries, each individually under the per-entry cap |
| `Worker__MaxReportArchiveEntries` | 512 | An archive of millions of tiny members |

The defaults sit far above any real aggregate report. They are there to stop an
attack, not to police size, and an operator whose reporters legitimately send
something larger can raise them.

A few decisions in there were less obvious than they look.

### Absolute bytes, not a compression ratio

A ratio limit ("refuse anything that expands more than 100×") reads like the
more principled control. We didn't use one. A ratio needs a trustworthy
compressed size for each entry, and the archive formats we receive don't
reliably carry one. An attacker can make the header say whatever they like. A
ratio check that silently doesn't apply on some code paths is worse than not
claiming to have one. Absolute caps can be enforced on every path, including the
ones where the archive lies about itself.

### The per-attachment cap is not redundant

It looks like it should be: if every entry is under 64 MB, why also cap the
total? Because the ingestion loop extracts every payload in an attachment before
it parses any of them, so all of them are in memory at once. A thousand entries
at 63 MB each is the same attack as one 63 GB entry, with more steps.

### Stop while reading, not after

The obvious implementation is to copy the decompressed stream somewhere and
check how much came out. By then it's too late: the memory is already allocated
and the bomb has already gone off. The extractor reads 80 KB at a time and counts
as it goes, throwing as soon as a limit is crossed. That rules out the
convenient one-line `CopyToAsync`, which only reports how much it copied once
it has finished copying.

## The bug the tests found

We built real bombs in the test suite rather than describing them in comments:
64 MB of zeroes gzipped, the same thing inside a zip behind a legitimate entry,
and a set of entries that are each legal and only fail on the total. Each test
asserts *which* limit fired.

The first run failed, correctly. The gzip path threw when a limit was hit. The
zip path caught the same exception and returned an empty result, so a refused
bomb in a zip file looked to the rest of the system like an attachment with
nothing in it. It never reached the parse-failure count and left no trace in
the sync run's statistics, which is the one place an operator would look for
it.

Both paths now throw. The refusal is counted as a parse failure, and the log
line names the limit that tripped and its configured value, so the response is
clear from the log alone: raise the limit, or go and look at what arrived in
the mailbox.

When a byte cap is breached, the whole attachment is discarded, including
payloads already extracted from it. An archive that has tried this is not one
to take partial results from.

## Two ingestion paths, two different answers

DMARC Analyzer later gained a second way in: an HTTP endpoint that accepts
reports pushed by another system. It shares the same extractor and limits, but
one limit deliberately behaves differently there.

On the mailbox path, entries past the 512-entry cap are skipped with a warning.
Mail can't be re-delivered on request, so taking what fits beats refusing all
of it. On the HTTP endpoint, the same archive is refused whole with a `413`
that names the setting. That caller can split the archive and post it again,
and a `200` reporting five inserted reports for a twenty-entry archive is
indistinguishable from having sent five. Same limit, different caller, different
right answer.

## What is still not bounded

The compressed attachment itself. By the time extraction runs, the sync loop has
already fetched the whole message. The practical ceiling there is the maximum
message size of the mail server receiving the reports, which is outside our
application. Expansion is the part with no natural ceiling, so it's the part we
bound. We'd rather say that plainly than imply the whole path is covered.

## If you read a reporting mailbox yourself

None of this is specific to our code. If you run anything that consumes DMARC
or TLS-RPT reports, whether a script, a SIEM integration or another analyzer,
it's worth checking:

- Is decompression bounded **while reading**, per entry and per attachment?
- Is the number of archive entries capped before any name-based filtering?
- Does a refused attachment show up somewhere an operator will see it, or does
  it disappear as "empty"?
- If ingestion stalls, does it stall for one mailbox or for everything?

If you run DMARC Analyzer older than v0.11.0, upgrade. The three settings are
documented in the
[application's configuration reference](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/docs/ops/configuration.md), and the change itself is
[pull request #165](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/pull/165)
on GitHub.

For background on what arrives at a `rua=` address in the first place, see
[what a DMARC aggregate report is](/glossary/dmarc-aggregate-report/).
