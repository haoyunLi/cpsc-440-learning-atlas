n <- 12; p <- 0.25; x <- 3
answer <- dbinom(x, n, p)
print(c(probability = answer, expected_count = n * p,
        manual = choose(n, x) * p^x * (1-p)^(n-x)))
