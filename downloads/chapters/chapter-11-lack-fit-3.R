# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: lack-fit
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Six original independent units, with one response at each distinct x.
# These constructed observations illustrate the procedure, not its calibration.
d <- data.frame(id=paste0("U",1:6), x=1:6, y=c(2,5,5,10,8,16))
fit <- lm(y ~ x, data=d)
d$fitted <- fitted(fit)
d$residual <- residuals(fit)
print(d, digits=10, row.names=FALSE)
print(c(intercept=unname(coef(fit)[1]), slope=unname(coef(fit)[2]),
        line_error_df=df.residual(fit), line_SSE=deviance(fit)))
par(mfrow=c(1,2))
plot(d$x,d$residual,xlab="x",ylab="Residual")
abline(h=0,lty=2)
text(d$x,d$residual,labels=d$id,pos=3)
qqnorm(d$residual)
qqline(d$residual)
par(mfrow=c(1,1))
# Do not treat the six unique x values as six replicated variance groups.
x_group <- factor(d$x)
group_median <- ave(d$y,x_group,FUN=median)
z <- abs(d$y-group_median)
# The same singleton problem remains if residuals are used instead of y.
z_from_residual <- abs(d$residual-ave(d$residual,x_group,FUN=median))
deviation_fit <- lm(z ~ x_group)
print(data.frame(id=d$id,x=d$x,y=d$y,group_median=group_median,z=z,
                 z_from_residual=z_from_residual),row.names=FALSE)
print(c(N=nrow(d),groups=nlevels(x_group),
        deviation_error_df=df.residual(deviation_fit),
        deviation_SSE=deviance(deviation_fit)))
stopifnot(length(unique(d$x))==nrow(d),all(z==0),all(z_from_residual==0),
          df.residual(fit)==4,df.residual(deviation_fit)==0,
          abs(unname(coef(fit)[1])+11/15)<1e-12,
          abs(unname(coef(fit)[2])-2.4)<1e-12)
# No within-group error degrees of freedom remain for a Brown-Forsythe F ratio.
# Do not interpret zero deviations as evidence of equal population variances.
# With six constructed points, neither plot proves a distributional assumption.
