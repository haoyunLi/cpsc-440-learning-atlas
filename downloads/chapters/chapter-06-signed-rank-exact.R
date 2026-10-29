# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: signed-rank-exact
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

d <- c(-1,2,3,4,5)
# This exact example has no zero differences and no tied magnitudes.
stopifnot(all(d != 0), !anyDuplicated(abs(d)))
r <- rank(abs(d))
observed_w <- sum(r[d > 0])
# Enumerate all 2^m sign assignments under the symmetric null.
signs <- as.matrix(expand.grid(rep(list(c(-1,1)),length(d))))
null_w <- as.vector((signs > 0) %*% r)
p_right <- mean(null_w >= observed_w)
p_two <- min(1,2*min(mean(null_w <= observed_w),p_right))
c(W_positive=observed_w, assignments=nrow(signs),
  p_right=p_right, p_two=p_two)
# R calls the positive signed-rank sum V.
wilcox.test(d,mu=0,alternative="greater",exact=TRUE,correct=FALSE)
