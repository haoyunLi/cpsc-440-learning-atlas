n <- 80; p <- .4; k <- 38
mu <- n*p
sigma <- sqrt(n*p*(1-p))
answer <- pnorm(k+.5, mu, sigma)
print(c(corrected=answer, exact=pbinom(k,n,p),
        uncorrected=pnorm(k,mu,sigma), z=(k+.5-mu)/sigma))
