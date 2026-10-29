# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 15, section: missing-block-cell-worked
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# The complete original teaching dataset has 12 observations.
complete <- data.frame(treatment=factor(rep(1:3,each=4)),
                       block=factor(rep(1:4,3)),
                       y=c(7,10,13,14,14,17,17,20,9,9,12,14))
# Remove one observation; do not replace it with zero or a fitted value.
d <- subset(complete,!(treatment=="2" & block=="4"))
print(with(d,table(treatment,block)))
fit <- lm(y ~ treatment+block,data=d)
X <- model.matrix(fit)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
print(c(N=nrow(d),columns=ncol(X),rank=qr(X)$rank,
        error_df=error_df,SSE=deviance(fit),MSE=mse))
print(coef(fit))
# Use the same equal-weight four-block grid for every treatment.
grid <- expand.grid(treatment=levels(d$treatment),block=levels(d$block))
Xg <- model.matrix(delete.response(terms(fit)),grid)
grid$fitted_mean <- as.vector(Xg%*%coef(fit))
adjusted <- aggregate(fitted_mean ~ treatment,data=grid,FUN=mean)
raw <- aggregate(y ~ treatment,data=d,FUN=mean)
print(raw)
print(adjusted)
# A contrast of adjusted means is a linear combination of coefficients.
L <- colMeans(Xg[grid$treatment=="2",,drop=FALSE])-
     colMeans(Xg[grid$treatment=="1",,drop=FALSE])
estimate <- as.numeric(L%*%coef(fit))
variance <- as.numeric(t(L)%*%vcov(fit)%*%L)
variance_factor <- as.numeric(t(L)%*%solve(crossprod(X),L))
se <- sqrt(variance)
critical <- qt(.975,df=error_df)
t_value <- estimate/se
raw_difference <- mean(d$y[d$treatment=="2"])-mean(d$y[d$treatment=="1"])
print(L)
print(c(raw_difference=raw_difference,adjusted_difference=estimate,
        variance_factor=variance_factor,variance=variance,SE=se,
        t=t_value,df=error_df,p_two_sided=2*pt(-abs(t_value),df=error_df),
        lower=estimate-critical*se,upper=estimate+critical*se))
# Recover observation weights and verify the variance without matrix shorthand.
weights <- as.vector(X%*%solve(crossprod(X),L))
manual_weights <- c(rep(-7/24,3),-1/8,rep(1/3,3),rep(-1/24,3),1/8)
print(cbind(d,weight=weights))
print(c(weighted_difference=sum(weights*d$y),sum_squared_weights=sum(weights^2)))
stopifnot(max(abs(weights-manual_weights))<1e-10,
          abs(sum(weights*d$y)-6)<1e-10,abs(sum(weights^2)-5/8)<1e-10)
# The missing-cell fitted mean is a model prediction, not a recovered observation.
print(grid[grid$treatment=="2" & grid$block=="4",])
stopifnot(nrow(d)==11,qr(X)$rank==6,error_df==5,
          abs(mse-1.2)<1e-10,abs(raw_difference-5)<1e-10,
          abs(estimate-6)<1e-10,abs(variance_factor-5/8)<1e-10,
          abs(variance-.75)<1e-10)
