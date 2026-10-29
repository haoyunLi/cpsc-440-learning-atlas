# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: without-replacement
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Three draws without replacement from six successes and four failures.
dhyper(2, m=6, n=4, k=3)
phyper(0, m=6, n=4, k=3, lower.tail=FALSE)
# Compare the all-success event under two different mechanisms.
c(without_replacement=dhyper(3,6,4,3),
  independent_trials=dbinom(3,3,.6))
