# Original transformed observations matching n=8, mean=3, sample variance=2.
a <- sqrt(3.5)
transformed <- 3+c(-a,-a,0,0,0,0,a,a)
y <- transformed^2-3/8
n <- length(y)
answer <- mean(transformed)^2+(n-1)/n*var(transformed)-3/8
print(data.frame(y=y,transformed=transformed))
print(c(n=n,mean_transformed=mean(transformed),
        variance_transformed=var(transformed),answer=answer,raw_mean=mean(y)))
print(c(naive_back_transform=mean(transformed)^2-3/8,
        missing_n_correction=mean(transformed)^2+var(transformed)-3/8,
        wrong_inverse_shift=mean(transformed)^2+3/8))
stopifnot(isTRUE(all.equal(answer,mean(y))))
