# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: unbalanced-ss-hypotheses
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original complete 3-by-2 design, with unequal cell counts.
cells <- list(c(7,8,9),c(11,13),c(10,12),c(12,13,15,16),16,c(18,20,22))
ni <- lengths(cells)
d <- data.frame(A=factor(rep(rep(c("A1","A2","A3"),each=2),ni)),
                B=factor(rep(rep(c("B1","B2"),3),ni)),y=unlist(cells))
with(d,table(A,B))
m0 <- lm(y ~ 1,data=d)
mA <- lm(y ~ A,data=d)
mB <- lm(y ~ B,data=d)
m_add <- lm(y ~ A+B,data=d)
m_full <- lm(y ~ A*B,data=d)
sse <- c(intercept=deviance(m0),A=deviance(mA),B=deviance(mB),
         additive=deviance(m_add),full=deviance(m_full))
print(sse)
error_df <- df.residual(m_full)
mse <- deviance(m_full)/error_df
# Numerators come from nested SSE differences; every test below uses full-model MSE.
ss_ab <- unname(sse["additive"]-sse["full"])
ss_I_AB <- unname(c(sse["intercept"]-sse["A"],
                    sse["A"]-sse["additive"],ss_ab))
ss_I_BA <- unname(c(sse["intercept"]-sse["B"],
                    sse["B"]-sse["additive"],ss_ab))
ss_II <- unname(c(sse["B"]-sse["additive"],
                  sse["A"]-sse["additive"],ss_ab))
# Cell-mean order: A1B1, A1B2, A2B1, A2B2, A3B1, A3B2.
mu <- vapply(cells,mean,numeric(1))
V0 <- diag(1/ni)
CA <- rbind(A2_minus_A1=c(-.5,-.5,.5,.5,0,0),
            A3_minus_A1=c(-.5,-.5,0,0,.5,.5))
CB <- matrix(rep(c(-1,1),3)/3,nrow=1)
contrast_ss <- function(C) {
  estimate <- C %*% mu
  covariance_factor <- C %*% V0 %*% t(C)
  as.numeric(t(estimate) %*% solve(covariance_factor,estimate))
}
ss_III <- c(contrast_ss(CA),contrast_ss(CB),ss_ab)
print(CA %*% mu)
print(CA %*% V0 %*% t(CA))
result <- data.frame(type=rep(c("I: A,B,AB","I: B,A,AB","II","III"),each=3),
                     effect=c("A","B","AB","B","A","AB",
                              "A","B","AB","A","B","AB"),
                     SS=c(ss_I_AB,ss_I_BA,ss_II,ss_III),
                     df=c(2,1,2,1,2,2,2,1,2,2,1,2))
result$F <- result$SS/result$df/mse
result$p <- pf(result$F,result$df,error_df,lower.tail=FALSE)
print(result,row.names=FALSE)
# A single-model anova call is sequential and therefore depends on term order.
print(anova(m_full))
print(anova(lm(y ~ B*A,data=d)))
# Independently check Type III using sum-coded columns and explicit restrictions.
fit_sum <- lm(y ~ A*B,data=d,contrasts=list(A=contr.sum,B=contr.sum))
X <- model.matrix(fit_sum)
checked <- vapply(1:2,function(term) {
  reduced_X <- X[,attr(X,"assign")!=term,drop=FALSE]
  restricted <- lm.fit(reduced_X,d$y)
  sum(restricted$residuals^2)-deviance(fit_sum)
},numeric(1))
print(c(TypeIII_A_check=checked[1],TypeIII_B_check=checked[2]))
stopifnot(error_df==9,abs(mse-8/3)<1e-10,
          max(abs(checked-ss_III[1:2]))<1e-10,
          abs(sum(ss_I_AB)-(sse["intercept"]-sse["full"]))<1e-10)
