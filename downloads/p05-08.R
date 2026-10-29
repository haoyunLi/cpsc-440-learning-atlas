n <- 9
answer <- pbinom(7, n, 0.5) - pbinom(1, n, 0.5)
print(c(coverage = answer, lower_index = 2, upper_index = 8))
