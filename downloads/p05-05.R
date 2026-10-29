# Exact planning model: independent observations from N(mu, sigma^2), known sigma.
mu0 <- 100; mu1 <- 96; sigma <- 12; n <- 36
se <- sigma / sqrt(n)
critical_mean <- mu0 + qnorm(0.05) * se
answer <- pnorm(critical_mean, mu1, se, lower.tail = FALSE)
print(c(threshold = critical_mean, beta = answer, power = 1-answer))
