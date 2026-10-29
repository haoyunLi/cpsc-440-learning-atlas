# Complete original 3-by-2-by-2 design with five independent units per cell.
d <- expand.grid(A=factor(1:3), B=factor(1:2), C=factor(1:2),
                 replicate=1:5)
d$cell <- interaction(d$A,d$B,d$C,drop=TRUE)
scales <- c(1,1,1,1,1,1,2,2,2,3,3,3)
d$y <- 2*as.integer(d$cell) +
       rep(scales,times=5)*rep(c(-2,-1,0,1,2),each=12)
d$z <- abs(d$y-ave(d$y,d$cell,FUN=median))
print(table(d$cell))
fit <- aov(z~cell,data=d)
print(summary(fit))
print(c(cells=nlevels(d$cell), numerator_df=nlevels(d$cell)-1,
        error_df=df.residual(fit), pure_ABC_df=(3-1)*(2-1)*(2-1)))
stopifnot(nlevels(d$cell)==12,df.residual(fit)==48)
