# Theoretical probabilities under a standard normal model
k <- 1:3
cbind(k = k, probability = pnorm(k) - pnorm(-k))
