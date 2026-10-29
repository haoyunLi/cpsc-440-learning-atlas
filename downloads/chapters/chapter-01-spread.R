# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 01, section: spread
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Enumerate two independent draws from P(Y = 0) = P(Y = 2) = 1/2.
# The draws have the same distribution, as in sampling with replacement.
values <- c(0, 2)
probabilities <- c(0.5, 0.5)
mu <- sum(values * probabilities)
sigma2 <- sum((values - mu)^2 * probabilities)
sigma <- sqrt(sigma2)
n <- 2
samples <- data.frame(Y1 = rep(values, each = 2),
                      Y2 = rep(values, times = 2))
samples$probability <- rep(0.25, nrow(samples))
samples$mean <- (samples$Y1 + samples$Y2) / n
samples$SS <- (samples$Y1 - samples$mean)^2 +
              (samples$Y2 - samples$mean)^2
samples$divide_n <- samples$SS / n
samples$s2 <- samples$SS / (n - 1)
samples$s <- sqrt(samples$s2)
print(samples, digits = 12, row.names = FALSE)

# Compute expectations over every possible ordered sample, not one selected sample.
expected <- c(
  true_variance = sigma2,
  E_divide_n = sum(samples$probability * samples$divide_n),
  E_s2 = sum(samples$probability * samples$s2),
  true_SD = sigma,
  E_s = sum(samples$probability * samples$s)
)
print(expected, digits = 12)
stopifnot(all(samples$SS == c(0, 2, 2, 0)))
stopifnot(abs(expected["E_divide_n"] - 0.5) < 1e-12)
stopifnot(abs(expected["E_s2"] - sigma2) < 1e-12)
stopifnot(abs(expected["E_s"] - sqrt(2) / 2) < 1e-12)

# Check that base R var() uses the n - 1 denominator in every row.
r_variances <- apply(samples[c("Y1", "Y2")], 1, var)
stopifnot(isTRUE(all.equal(as.numeric(r_variances), samples$s2)))
