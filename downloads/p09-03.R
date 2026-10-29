c1 <- c(-1,1,0); c2 <- c(-1,-1,2); n <- c(5,10,10)
answer <- sum(c1*c2/n)
print(c(unweighted_dot=sum(c1*c2),covariance_over_sigma2=answer))
