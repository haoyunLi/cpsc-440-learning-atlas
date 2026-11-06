mu <- c(11,13,16,20)
w <- rep(1/4,4)
print(c(sum_weights=sum(w),weighted=sum(w*mu),mean=mean(mu)))
stopifnot(sum(w)==1, sum(w*mu)==mean(mu))
