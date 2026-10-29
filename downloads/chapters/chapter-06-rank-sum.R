# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: rank-sum
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Reproduce the two-group ranking example above.
x <- c(1, 4)
y <- c(2, 3)
combined_ranks <- rank(c(x, y))
raw_rank_sum <- sum(combined_ranks[seq_along(x)])
u <- raw_rank_sum - length(x)*(length(x)+1)/2
c(raw_rank_sum=raw_rank_sum, U=u)
# No ties: enumerate the exact null distribution.
wilcox.test(x, y, alternative="two.sided", exact=TRUE,
            correct=FALSE)
