# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 14, section: three-way
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original complete fixed-effects 2-by-2-by-2 design, three independent pots per cell.
grid <- expand.grid(A=factor(c("A1","A2")),B=factor(c("B1","B2")),
                    C=factor(c("C1","C2")))
cell_means <- c(10,14,12,20,10,14,14,14)
d <- grid[rep(seq_len(nrow(grid)),times=3),]
d$y <- rep(cell_means,times=3)+rep(c(-1,0,1),each=8)
rownames(d) <- NULL
fit <- lm(y ~ A*B*C,data=d)
tab <- anova(fit)
print(with(d,table(A,B,C)))
print(tab)
mu <- with(d,tapply(y,list(A,B,C),mean))
print(mu)
# Estimate A2 - A1 at each B and C, then difference over B within each C.
simple_A <- mu["A2",,]-mu["A1",,]
AB_given_C <- simple_A["B2",]-simple_A["B1",]
L <- unname(AB_given_C["C2"]-AB_given_C["C1"])
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
r <- 3
se <- sqrt(8*mse/r)
t_value <- L/se
critical <- qt(.975,error_df)
p_two <- 2*pt(-abs(t_value),error_df)
print(simple_A)
print(AB_given_C)
print(c(AB_averaged_over_C=mean(AB_given_C),ABC_contrast=L,
        MSE=mse,error_df=error_df,SE=se,t=t_value,F=t_value^2,p=p_two,
        lower=L-critical*se,upper=L+critical*se))
# Cross-check the contrast with the fitted coefficient covariance matrix.
# grid order is A1B1, A2B1, A1B2, A2B2, first at C1 and then at C2.
w <- c(-1,1,1,-1,1,-1,-1,1)
X <- model.matrix(delete.response(terms(fit)),data=grid)
L_row <- as.numeric(w %*% X)
L_model <- sum(L_row*coef(fit))
se_model <- sqrt(as.numeric(t(L_row)%*%vcov(fit)%*%L_row))
# Removing only ABC gives the nested-model check for its one degree of freedom.
no_ABC <- lm(y ~ (A+B+C)^2,data=d)
ss_ABC <- deviance(no_ABC)-deviance(fit)
print(anova(no_ABC,fit))
print(c(total_SS=sum((d$y-mean(d$y))^2),ABC_SS=ss_ABC,
        model_contrast=L_model,model_SE=se_model))
stopifnot(error_df==16,abs(mse-1)<1e-10,
          max(abs(tab[,"Sum Sq"]-c(96,54,6,0,24,6,24,16)))<1e-9,
          abs(L_model-L)<1e-10,abs(se_model-se)<1e-10,
          abs(ss_ABC-r*L^2/8)<1e-10,
          abs(tab["A:B:C","F value"]-t_value^2)<1e-10,
          abs(tab["A:B:C","Pr(>F)"]-p_two)<1e-10)
