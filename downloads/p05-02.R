n <- 16; ybar <- 20; s <- 4
ci <- ybar + c(-1, 1) * qt(0.975, n - 1) * s / sqrt(n)
answer <- ci[1]
ci
