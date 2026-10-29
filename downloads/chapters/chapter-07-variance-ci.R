# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 07, section: variance-ci
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Constructed data with n = 10 and sample variance = 4.
y <- c(17, 17, 20, 20, 20, 20, 20, 20, 23, 23)
df <- length(y) - 1
variance_ci <- df*var(y)/qchisq(c(.975, .025), df)
c(n=length(y), sample_variance=var(y), df=df)
variance_ci
sqrt(variance_ci)
# Additional right-tailed test: H0 sigma <= 1.5 vs H1 sigma > 1.5.
sigma0 <- 1.5
Q <- df*var(y)/sigma0^2
c(Q=Q, df=df, p_right=pchisq(Q, df, lower.tail=FALSE))
