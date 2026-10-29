difference <- c(-2, -1, 0.5, 1, 2, 4, 7, 12, 20)
nonzero <- difference[difference != 0]
binom.test(sum(nonzero > 0), length(nonzero), p = 0.5)
