y <- c(12,4,21,7,18,2,25,9,16,5,14)
n <- length(y)
k_values <- seq_len(floor((n+1)/2))
coverage <- 1-2*pbinom(k_values-1,n,.5)
k <- max(k_values[coverage >= .95])
interval <- sort(y)[c(k,n-k+1)]
answer <- interval[1]
print(data.frame(k=k_values,coverage=coverage))
print(c(k=k,lower=answer,upper=interval[2]))
