# Only the 11 observed responses enter this fixed-block additive model.
d <- data.frame(treatment=factor(c(rep(1,4),rep(2,3),rep(3,4))),
                block=factor(c(1:4,1:3,1:4)),
                y=c(7,10,13,14,14,17,17,9,9,12,14))
fit <- lm(y ~ treatment+block,data=d)
X <- model.matrix(fit)
mse <- deviance(fit)/df.residual(fit)
# Equal block weights cancel the block coefficients in this additive contrast.
L <- setNames(rep(0,length(coef(fit))),names(coef(fit)))
L["treatment2"] <- 1
variance <- as.numeric(t(L)%*%vcov(fit)%*%L)
answer <- sqrt(variance)
variance_factor <- as.numeric(t(L)%*%solve(crossprod(X),L))
print(c(N=nrow(d),rank=qr(X)$rank,error_df=df.residual(fit),MSE=mse,
        adjusted_difference=as.numeric(L%*%coef(fit)),
        variance_factor=variance_factor,variance=variance,SE=answer))
stopifnot(nrow(d)==11,qr(X)$rank==6,df.residual(fit)==5,
          abs(variance_factor-5/8)<1e-10,abs(variance-.75)<1e-10)
