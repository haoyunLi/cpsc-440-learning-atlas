n <- c(3,4,5); means <- c(10,12,14); vars <- c(1,4,4)
grand <- weighted.mean(means,n)
ssb <- sum(n*(means-grand)^2); sse <- sum((n-1)*vars)
df <- c(2,sum(n)-3)
f <- (ssb/df[1])/(sse/df[2])
print(c(grand=grand,ssb=ssb,sse=sse,sst=ssb+sse,F=f,
        critical=qf(.95,df[1],df[2]),p=pf(f,df[1],df[2],lower.tail=FALSE)))
y <- c(9,10,11,12+c(-sqrt(6),0,0,sqrt(6)),14+c(-sqrt(8),0,0,0,sqrt(8)))
g <- factor(rep(LETTERS[1:3],n))
tab <- summary(aov(y~g))[[1]]
print(tab)
stopifnot(abs(f-tab$"F value"[1]) < 1e-10, abs(f-4.6) < 1e-10)
