x <- c(8, 9, 10, 11, 12, 14, 16, 24)
bins <- cut(x, breaks = c(8, 12, 16, 20, 24), right = FALSE)
bins[x == 24] <- levels(bins)[4]
print(table(bins) / length(x))
answer <- sum(x >= 8 & x < 12) / length(x)
answer
