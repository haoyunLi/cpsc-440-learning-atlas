mu <- 20; sigma <- 3; n <- 9
se <- sigma / sqrt(n)
answer <- pnorm(22, mean = mu, sd = se, lower.tail = FALSE)
print(c(individual = pnorm(22, mu, sigma, lower.tail = FALSE),
        sample_mean = answer, SE = se))
