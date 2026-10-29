# Original calibration experiment under a true equal-means null.
RNGkind("Mersenne-Twister","Inversion","Rejection")
set.seed(607441)
B <- 20000
n1 <- 8
n2 <- 32
x <- matrix(rnorm(n1*B,mean=0,sd=3),nrow=n1)
y <- matrix(rnorm(n2*B,mean=0,sd=1),nrow=n2)
mx <- colMeans(x)
my <- colMeans(y)
vx <- colSums(sweep(x,2,mx,"-")^2)/(n1-1)
vy <- colSums(sweep(y,2,my,"-")^2)/(n2-1)
sp2 <- ((n1-1)*vx+(n2-1)*vy)/(n1+n2-2)
p_pooled <- 2*pt(-abs((mx-my)/sqrt(sp2*(1/n1+1/n2))),df=n1+n2-2)
a <- vx/n1
b <- vy/n2
df_welch <- (a+b)^2/(a^2/(n1-1)+b^2/(n2-1))
p_welch <- 2*pt(-abs((mx-my)/sqrt(a+b)),df=df_welch)
counts <- c(sum(p_pooled<.05),sum(p_welch<.05))
rate <- counts/B
print(data.frame(method=c("pooled","Welch"),rejections=counts,
                 B=B,rejection_rate=rate,MCSE=sqrt(rate*(1-rate)/B)))
# Verify both formulas against independent base-R t.test calls.
stopifnot(abs(p_pooled[1]-t.test(x[,1],y[,1],var.equal=TRUE)$p.value)<1e-12,
          abs(p_welch[1]-t.test(x[,1],y[,1],var.equal=FALSE)$p.value)<1e-12)
# Both procedures test the same mean difference; the null is true here.
answer <- 2L
print(answer)

