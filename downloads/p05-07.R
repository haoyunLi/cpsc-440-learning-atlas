x <- c(20,21,22,23,24,25,26,27,28,18,19)
# Condition on nonzero differences and assume fair, independent signs under H0.
d <- x[x != 20] - 20
n <- length(d); positive <- sum(d > 0)
answer <- pbinom(positive-1, n, 0.5, lower.tail = FALSE)
print(c(n = n, positive = positive, p_value = answer))
stopifnot(n == 10, positive == 8, abs(answer - 56/1024) < 1e-12)
# A median with positive point mass need not give fair signs after removing ties.
values <- c(10,20,30)
probability <- c(.1,.6,.3)
p_le <- sum(probability[values <= 20])
p_ge <- sum(probability[values >= 20])
p_positive_nonzero <- sum(probability[values > 20])/sum(probability[values != 20])
print(c(p_le_20 = p_le, p_ge_20 = p_ge,
        p_positive_given_nonzero = p_positive_nonzero))
stopifnot(p_le >= .5, p_ge >= .5,
          abs(p_positive_nonzero - .75) < 1e-12)
