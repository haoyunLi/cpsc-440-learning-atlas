n <- 12; s <- 4; sigma0 <- 3
answer <- (n-1)*s^2/sigma0^2
print(c(chisq = answer, df = n-1,
        p = pchisq(answer,n-1,lower.tail=FALSE)))
