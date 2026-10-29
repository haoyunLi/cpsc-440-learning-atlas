# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 08, section: welch-anova-complete
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

y <- c(9,10,11,10, 5,9,13,17,21,25, 10,11,12,13,14)
g <- factor(rep(c("A","B","C"),c(4,6,5)))
ni <- as.numeric(table(g))
mi <- as.numeric(tapply(y,g,mean))
si2 <- as.numeric(tapply(y,g,var))
stopifnot(all(ni > 1),all(si2 > 0))
k <- length(ni)
# Estimate the precision of each group mean separately.
w <- ni/si2
W <- sum(w)
weighted_mean <- sum(w*mi)/W
U <- sum((1-w/W)^2/(ni-1))
A <- sum(w*(mi-weighted_mean)^2)/(k-1)
C <- 1+2*(k-2)*U/(k^2-1)
f_welch <- A/C
df1 <- k-1
df2 <- (k^2-1)/(3*U)
p_welch <- pf(f_welch,df1,df2,lower.tail=FALSE)
print(data.frame(group=levels(g),n=ni,mean=mi,variance=si2,weight=w))
print(c(weighted_mean=weighted_mean,F=f_welch,
        numerator_df=df1,denominator_df=df2,p=p_welch))
# Verify the manual calculation against base R.
fit <- oneway.test(y ~ g,var.equal=FALSE)
print(fit)
stopifnot(abs(unname(fit$statistic)-f_welch) < 1e-10,
          abs(fit$p.value-p_welch) < 1e-10)
