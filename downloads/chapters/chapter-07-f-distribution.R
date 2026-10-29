# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 07, section: f-distribution
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original software example; use independent normal-population assumptions.
x <- 8:15
y <- 5:15
rbind(x=c(n=length(x), variance=var(x)),
      y=c(n=length(y), variance=var(y)))
var.test(x, y, alternative="two.sided", ratio=1, conf.level=.95)
# Reversing the quantile tail also exchanges numerator and denominator df.
c(direct=qf(.025, 7, 10), reciprocal=1/qf(.975, 10, 7))
