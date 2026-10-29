# New original two-replicate cells, distinct from the lesson example.
grid <- expand.grid(A=factor(c("A1","A2")),B=factor(c("B1","B2")),
                    C=factor(c("C1","C2")))
cell_means <- c(8,10,10,18,12,20,14,16)
d <- grid[rep(seq_len(8),times=2),]
d$y <- rep(cell_means,2)+rep(c(-1,1),each=8)
fit <- lm(y ~ A*B*C,data=d)
mu <- with(d,tapply(y,list(A,B,C),mean))
simple_A <- mu["A2",,]-mu["A1",,]
AB_given_C <- simple_A["B2",]-simple_A["B1",]
L <- unname(AB_given_C["C2"]-AB_given_C["C1"])
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
F_ABC <- L^2/(8*mse/2)
tab <- anova(fit)
print(mu)
print(AB_given_C)
print(tab)
print(c(AB_averaged=mean(AB_given_C),ABC_contrast=L,
        error_df=error_df,MSE=mse,F_ABC=F_ABC,
        P_ABC=pf(F_ABC,1,error_df,lower.tail=FALSE)))
stopifnot(max(abs(AB_given_C-c(6,-6)))<1e-10,
          abs(mean(AB_given_C))<1e-10,
          error_df==8,abs(mse-2)<1e-10,
          abs(F_ABC-18)<1e-10,
          abs(F_ABC-tab["A:B:C","F value"])<1e-10)
# The second choice distinguishes a marginal average from conditional interactions.
answer <- 1L
print(answer)

