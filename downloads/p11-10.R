# Original training data; the future response is kept out of the fitted model.
d <- data.frame(x=0:5,y=c(2,6,7,9,12,12))
fit <- lm(y ~ x,data=d)
n <- nrow(d)
xbar <- mean(d$x)
ybar <- mean(d$y)
sxx <- sum((d$x-xbar)^2)
sxy <- sum((d$x-xbar)*(d$y-ybar))
error_df <- df.residual(fit)
sse <- deviance(fit)
mse <- sse/error_df
critical <- qt(.975,error_df)
print(c(n=n,xbar=xbar,ybar=ybar,Sxx=sxx,Sxy=sxy,
        SSE=sse,error_df=error_df,MSE=mse,critical=critical),digits=12)
print(coef(fit),digits=12)
# Compare the design center with a prespecified position at the observed edge.
x0 <- c(xbar,5)
fitted_mean <- unname(coef(fit)[1]+coef(fit)[2]*x0)
h0 <- 1/n+(x0-xbar)^2/sxx
se_mean <- sqrt(mse*h0)
se_new <- sqrt(mse*(1+h0))
mean_half <- critical*se_mean
prediction_half <- critical*se_new
manual <- data.frame(x0=x0,fitted=fitted_mean,h0=h0,SE_mean=se_mean,SE_new=se_new,
                     mean_lower=fitted_mean-mean_half,mean_upper=fitted_mean+mean_half,
                     prediction_lower=fitted_mean-prediction_half,
                     prediction_upper=fitted_mean+prediction_half)
print(manual,digits=12,row.names=FALSE)
# Check both formula calculations against independent predict.lm calls.
ci <- predict(fit,newdata=data.frame(x=x0),interval="confidence",level=.95)
pi <- predict(fit,newdata=data.frame(x=x0),interval="prediction",level=.95)
print(ci,digits=12)
print(pi,digits=12)
stopifnot(n==6,error_df==4,abs(xbar-2.5)<1e-12,abs(sxx-17.5)<1e-12,
          abs(sxy-35)<1e-12,abs(sse-4)<1e-12,abs(mse-1)<1e-12,
          max(abs(coef(fit)-c(3,2)))<1e-12,
          abs(h0[2]-11/21)<1e-12,
          max(abs(ci[,c("lwr","upr")]-as.matrix(manual[,c("mean_lower","mean_upper")])))<1e-12,
          max(abs(pi[,c("lwr","upr")]-as.matrix(manual[,c("prediction_lower","prediction_upper")])))<1e-12,
          max(abs(ci[2,c("lwr","upr")]-c(10.9905565607796,15.0094434392204)))<1e-10,
          max(abs(pi[2,c("lwr","upr")]-c(9.57268175425703,16.427318245743)))<1e-10,
          mean_half[2]>mean_half[1],prediction_half[2]>prediction_half[1])
# The future response is compared with the two targets without refitting.
y_new <- 10.5
membership <- c(mean_CI=y_new>=ci[2,"lwr"] && y_new<=ci[2,"upr"],
                individual_PI=y_new>=pi[2,"lwr"] && y_new<=pi[2,"upr"])
print(membership)
stopifnot(!membership[["mean_CI"]],membership[["individual_PI"]])
# Diagnose the wrong route that drops the distance from xbar.
wrong_no_distance <- rbind(
  mean_CI=fitted_mean[2]+c(-1,1)*critical*sqrt(mse/n),
  individual_PI=fitted_mean[2]+c(-1,1)*critical*sqrt(mse*(1+1/n)))
colnames(wrong_no_distance) <- c("lower","upper")
print(wrong_no_distance,digits=12)
stopifnot(max(abs(wrong_no_distance[1,]-c(11.8665210322362,14.1334789677638)))<1e-10,
          max(abs(wrong_no_distance[2,]-c(10.0010965349749,15.9989034650251)))<1e-10)
# One successful prediction does not establish the model assumptions as true.
answer <- 2L
print(answer)
