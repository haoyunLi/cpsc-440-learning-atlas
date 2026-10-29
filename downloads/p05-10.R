n <- 10; mu0 <- 50; mu1 <- 54; sigma <- 6; alpha <- 0.05
critical <- qt(1-alpha,df=n-1)
ncp <- (mu1-mu0)*sqrt(n)/sigma
answer <- pt(critical,df=n-1,ncp=ncp)
print(c(critical_t=critical,noncentrality=ncp,beta=answer,power=1-answer))
