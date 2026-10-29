d <- c(0,-1,1,2,-2,4,5)
nz <- d[d!=0]
m <- length(nz)
r <- rank(abs(nz),ties.method="average")
w_plus <- sum(r[nz>0])
w_minus <- sum(r[nz<0])
# The zero difference has no rank or random sign under this convention.
signs <- as.matrix(expand.grid(rep(list(c(-1,1)),m)))
null_w <- as.vector((signs>0) %*% r)
answer <- mean(null_w>=w_plus)
expected <- m*(m+1)/4
variance <- sum(r^2)/4
print(data.frame(difference=nz,rank=r))
print(c(m=m,W_positive=w_plus,W_negative=w_minus,S=w_plus-expected,
        variance=variance,assignments=nrow(signs),
        right_extreme=sum(null_w>=w_plus),answer=answer))
# These diagnostic values are approximations, not the requested exact probability.
print(c(normal_no_cc=pnorm((w_plus-expected)/sqrt(variance),lower.tail=FALSE),
        normal_with_cc=pnorm((w_plus-expected-.5)/sqrt(variance),lower.tail=FALSE),
        exact_two_sided=2*answer))
stopifnot(m==6,w_plus==16,w_minus==5,nrow(signs)==64,
          sum(null_w>=w_plus)==11,abs(answer-.171875)<1e-12)
