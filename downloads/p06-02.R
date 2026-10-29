n1 <- 6; n2 <- 6; m1 <- 15; m2 <- 11; s1 <- 2; s2 <- 4
sp2 <- ((n1-1)*s1^2+(n2-1)*s2^2)/(n1+n2-2)
answer <- (m1-m2)/sqrt(sp2*(1/n1+1/n2))
print(c(pooled_variance = sp2, t = answer,
        p = 2*pt(-abs(answer),n1+n2-2)))
