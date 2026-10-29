# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 15, section: factorial-rcbd-worked
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original 2-by-3 treatment cells, each present once in every complete block.
cell_mean <- c(10,12,14,11,16,21)
block_shift <- c(-4,0,4)
e <- rbind(c(-1,0,1),c(1,-1,0),c(0,1,-1),
           c(1,0,-1),c(-1,1,0),c(0,-1,1))
y_cell_block <- outer(cell_mean,block_shift,"+")+e
d <- data.frame(A=factor(rep(rep(c("A1","A2"),each=3),each=3)),
                B=factor(rep(rep(c("B1","B2","B3"),2),each=3)),
                block=factor(rep(1:3,6)),y=as.vector(t(y_cell_block)))
print(y_cell_block)
print(with(d,table(A,B,block)))
# Fixed block indicators recover balanced-model treatment contrasts.
# This lm call is not a REML fit of a random-intercept model.
fit <- lm(y ~ block+A*B,data=d)
tab <- anova(fit)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
print(tab)
# Independently reconstruct all orthogonal sums of squares.
mean_cell <- with(d,tapply(y,list(A,B),mean))
mean_A <- rowMeans(mean_cell)
mean_B <- colMeans(mean_cell)
grand <- mean(d$y)
mean_block <- tapply(d$y,d$block,mean)
a <- nlevels(d$A)
b <- nlevels(d$B)
r <- nlevels(d$block)
interaction <- sweep(sweep(mean_cell,1,mean_A,"-"),2,mean_B,"-")+grand
ss <- c(A=b*r*sum((mean_A-grand)^2),
        B=a*r*sum((mean_B-grand)^2),
        AB=r*sum(interaction^2),
        block=a*b*sum((mean_block-grand)^2),
        error=deviance(fit),total=sum((d$y-grand)^2))
print(ss)
# Three pre-specified A2-minus-A1 simple effects form one comparison family.
family_size <- b
estimate <- unname(mean_cell["A2",]-mean_cell["A1",])
se <- sqrt(2*mse/r)
t_value <- estimate/se
p_raw <- 2*pt(-abs(t_value),df=error_df)
critical <- qt(1-.05/(2*family_size),df=error_df)
simple <- data.frame(B=colnames(mean_cell),estimate=estimate,SE=se,
                     df=error_df,t=t_value,p_raw=p_raw,
                     p_Bonferroni=pmin(1,family_size*p_raw),
                     lower=estimate-critical*se,upper=estimate+critical*se)
print(simple,row.names=FALSE)
# Confirm the simple-effect covariance with the complete fitted model.
grid <- expand.grid(A=levels(d$A),B=levels(d$B),block=levels(d$block))
Xg <- model.matrix(delete.response(terms(fit)),grid)
L <- do.call(rbind,lapply(levels(d$B),function(level) {
  colMeans(Xg[grid$A=="A2" & grid$B==level,,drop=FALSE])-
    colMeans(Xg[grid$A=="A1" & grid$B==level,,drop=FALSE])
}))
stopifnot(max(abs(as.vector(L%*%coef(fit))-estimate))<1e-10,
          max(abs(diag(L%*%vcov(fit)%*%t(L))-se^2))<1e-10)
# Omitting a design term changes the residual, even in a balanced dataset.
ignored <- lm(y ~ A*B,data=d)
print(anova(ignored))
print(c(error_df_with_blocks=error_df,MSE_with_blocks=mse,
        error_df_without_blocks=df.residual(ignored),
        MSE_without_blocks=deviance(ignored)/df.residual(ignored)))
stopifnot(nrow(d)==18,error_df==10,abs(mse-1.2)<1e-10,
          max(abs(ss-c(72,147,27,192,12,450)))<1e-10,
          abs(deviance(ignored)-ss["block"]-ss["error"])<1e-10)
# Diagnostic displays do not verify independence or prove a distribution model.
par(mfrow=c(1,2))
plot(fitted(fit),residuals(fit),xlab="Fitted response",ylab="Residual")
abline(h=0,lty=2)
qqnorm(residuals(fit))
qqline(residuals(fit))
par(mfrow=c(1,1))
