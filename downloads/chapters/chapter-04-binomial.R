# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: binomial
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

dbinom(18, size=20, prob=.85) # Exactly 18 successes
pbinom(17,20,.85,lower.tail=FALSE) # Strictly greater than 17, i.e. at least 18
# SAS: PDF('BINOMIAL',k,p,n); CDF('BINOMIAL',k,p,n)
