# Illustrate sensitivity without changing the source data
x <- c(9,10,10,11,12,68)
c(mean_all=mean(x), median_all=median(x),
  mean_without_largest=mean(x[-which.max(x)]))
