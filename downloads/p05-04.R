# Exact planning model: independent observations from N(mu, sigma^2), known sigma.
mu0 <- 50; mu1 <- 52; sigma <- 6; n <- 36; alpha <- 0.05
se <- sigma / sqrt(n)
critical_mean <- mu0 + qnorm(1-alpha) * se
answer <- pnorm(critical_mean, mu1, se)
print(c(threshold = critical_mean, beta = answer, power = 1-answer))
