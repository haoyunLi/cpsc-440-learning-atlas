# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 06, section: signed-rank
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original one-sample example: test a prespecified symmetric center.
y <- c(6, 8, 9, 13, 15)
M0 <- 10
d <- y - M0
stopifnot(all(d != 0), !anyDuplicated(abs(d)))
ranks <- rank(abs(d))
W_plus <- sum(ranks[d > 0])
W_minus <- sum(ranks[d < 0])
print(data.frame(y = y, difference = d, absolute_rank = ranks))
print(c(W_plus = W_plus, W_minus = W_minus))

# A direct one-sample call is equivalent to testing the centered differences.
direct <- wilcox.test(y, mu = M0, alternative = "two.sided",
                      exact = TRUE, correct = FALSE)
via_difference <- wilcox.test(d, mu = 0, alternative = "two.sided",
                              exact = TRUE, correct = FALSE)
print(direct)
print(via_difference)

# Independently enumerate all 2^5 equally likely sign allocations under the null.
signs <- as.matrix(expand.grid(rep(list(c(-1, 1)), length(d))))
null_W_plus <- drop((signs > 0) %*% ranks)
null_center <- sum(ranks) / 2
exact_two_sided <- mean(abs(null_W_plus - null_center) >=
                        abs(W_plus - null_center))
print(c(exact_two_sided = exact_two_sided,
        direct_p = direct$p.value, centered_p = via_difference$p.value))
stopifnot(W_plus == 8, W_minus == 7, exact_two_sided == 1,
          unname(direct$statistic) == W_plus,
          unname(via_difference$statistic) == W_plus,
          abs(direct$p.value - exact_two_sided) < 1e-12,
          abs(via_difference$p.value - exact_two_sided) < 1e-12)

# Descriptive paired-median counterexample only: no hypothesis test is performed.
a <- c(0, 10, 11)
b <- c(0, 1, 10)
paired_difference <- a - b
print(data.frame(pair = 1:3, A = a, B = b, D = paired_difference))
print(c(median_difference = median(paired_difference),
        difference_of_medians = median(a) - median(b)))
stopifnot(median(paired_difference) == 1,
          median(a) - median(b) == 9)
# This example does not establish sign-test conditions after excluding its zero.
