# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: density
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

n <- 40
p <- .5
lower <- 15
upper <- 25
mu_count <- n*p
sd_count <- sqrt(n*p*(1-p))
# Keep both integer endpoints in the exact binomial calculation.
exact <- pbinom(upper,n,p)-pbinom(lower-1,n,p)
# Extend the continuous area to the outer edges of the integer bins.
normal_cc <- pnorm(upper+.5,mu_count,sd_count)-
  pnorm(lower-.5,mu_count,sd_count)
normal_uncorrected <- pnorm(upper,mu_count,sd_count)-
  pnorm(lower,mu_count,sd_count)
print(c(exact=exact,normal_cc=normal_cc,
        normal_uncorrected=normal_uncorrected))
stopifnot(abs(exact-.91930953224801) < 1e-12,
          abs(normal_cc-.91800967899962) < 1e-12)
# A skewed tail example: correction does not guarantee accuracy.
n_seed <- 20
p_seed <- .85
cutoff <- 12
print(c(expected_successes=n_seed*p_seed,
        expected_failures=n_seed*(1-p_seed),
        exact=pbinom(cutoff,n_seed,p_seed),
        normal_cc=pnorm(cutoff+.5,n_seed*p_seed,
                        sqrt(n_seed*p_seed*(1-p_seed)))))
