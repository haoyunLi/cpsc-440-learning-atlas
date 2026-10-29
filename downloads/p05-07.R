x <- c(20,21,22,23,24,25,26,27,28,18,19)
d <- x[x != 20] - 20
n <- length(d); positive <- sum(d > 0)
answer <- pbinom(positive-1, n, 0.5, lower.tail = FALSE)
print(c(n = n, positive = positive, p_value = answer))
