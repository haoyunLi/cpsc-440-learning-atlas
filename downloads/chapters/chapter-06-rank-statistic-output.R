# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: rank-statistic-output
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

a <- c(3,5,5)
b <- c(4,8,9)
# R reports the shifted rank sum for two independent samples.
r <- rank(c(a,b), ties.method="average")
raw_sum <- sum(r[seq_along(a)])
c(raw_rank_sum=raw_sum, W=raw_sum-length(a)*(length(a)+1)/2)
# Specify the approximation and correction to make output reproducible.
wilcox.test(a,b, alternative="less", exact=FALSE, correct=FALSE)
