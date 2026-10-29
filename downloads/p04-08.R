p <- pnorm(18,mean=20,sd=3)
answer <- dbinom(2,size=10,prob=p)
print(c(single_pass=p,exactly_two_pass=answer))
