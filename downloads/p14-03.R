cell_means <- c(Low=10,High=20)
sample_sizes <- c(9,1)
answer <- mean(cell_means)
c(equal_weight=answer,observed_weight=weighted.mean(cell_means,sample_sizes))
