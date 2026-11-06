# Check the teaching diagrams with base R calculations on their stated inputs.
options(warn=2)
close <- function(actual, expected, tolerance=1e-10) {
  stopifnot(length(actual)==length(expected),
            all(is.finite(actual)), all(abs(actual-expected)<=tolerance))
}

x <- c(2,4,6)
close(c(mean(x),sum(x-mean(x)),sum((x-mean(x))^2),var(x),sd(x)),c(4,0,8,4,2))
dice <- expand.grid(first=1:6,second=1:6)
A <- with(dice,first+second>=10)
B <- dice$first==6
close(c(mean(A),mean(B),mean(A&B),mean(A[B])),c(1/6,1/6,3/36,.5))

se <- 10/sqrt(25)
critical <- qnorm(.95,50,se)
beta <- pnorm(critical,54,se)
close(c(se,critical,beta,1-beta),c(2,53.2897072539,.361239968688,.638760031312),1e-8)
close(pnorm(critical,50,se,lower.tail=FALSE),.05)

before <- c(8,14,20,26,32)
after <- c(9,16,23,28,34)
d <- after-before
paired <- t.test(after,before,paired=TRUE)
close(d,c(1,2,3,2,2))
close(c(mean(d),var(d),unname(paired$parameter),unname(paired$statistic)),c(2,.5,4,6.32455532034))

quantiles <- qchisq(c(.025,.975),9)
close(quantiles,c(2.7004,19.0228),5e-5)
variance_ci <- 36/rev(quantiles)
close(variance_ci,c(1.8925,13.331),5e-4)
close(sqrt(variance_ci),c(1.376,3.651),5e-4)

group <- factor(rep(1:3,each=3))
y <- 4:12
fit <- aov(y~group)
close(as.numeric(tapply(y,group,mean)),c(5,8,11))
close(c(sum((y-mean(y))^2),summary(fit)[[1]][1,'Sum Sq'],deviance(fit)),c(60,54,6))

coefficients <- c(1,rep(-1/3,3))
contrast <- sum(coefficients*c(10,12,14,16))
se_contrast <- sqrt(4*sum(coefficients^2/4))
close(c(sum(coefficients),contrast,se_contrast,contrast/se_contrast),c(0,-4,sqrt(4/3),-sqrt(12)))

means <- rbind(c(10,12),c(14,20))
effects <- means[,2]-means[,1]
close(c(effects,diff(effects)),c(2,6,4))
blocks <- -2:2*2
y <- outer(blocks,c(10,12,14),'+')
close(as.numeric(y[,2]-y[,1]),rep(2,5))
close(as.numeric(y[,3]-y[,1]),rep(4,5))

road <- data.frame(x=c(1,3,4,5,7),y=c(6,14,10,14,26))
line <- lm(y~x,road)
close(unname(coef(line)),c(2,3))
close(residuals(line),c(1,3,-4,-3,3))
close(c(deviance(line),deviance(line)/df.residual(line)),c(44,44/3))

# Confirm the key edited problem results using the reference distributions.
close(pt(2,9,lower.tail=FALSE),.03827641189)
close(20-qt(.975,15),17.8685504544)
stopifnot(2*qnorm(.975)*4/sqrt(62)<=2,2*qnorm(.975)*4/sqrt(61)>2)
close(pnorm(qnorm(.95,50,1),52,1),beta)
close(pnorm(qnorm(.05,100,2),96,2,lower.tail=FALSE),beta)
cat('Ten diagram examples and the edited inference calculations match independent base R.\n')
