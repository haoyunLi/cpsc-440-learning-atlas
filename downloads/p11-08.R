# Original six-point dataset; fit the same intercept-and-slope model throughout.
d <- data.frame(x=c(0,1,2,3,4,10),y=c(1,2,5,8,9,5))
fit <- lm(y ~ x,data=d)
n <- nrow(d)
p <- fit$rank
mse <- deviance(fit)/df.residual(fit)
h <- hatvalues(fit)
e <- residuals(fit)
i <- 6L
# Cook's distance uses the full-model MSE and the number of coefficients.
cook_formula <- e[i]^2*h[i]/(p*mse*(1-h[i])^2)
cook_r <- cooks.distance(fit)[i]
# Evaluate both fitted lines at all six original x values, including the omitted case.
fit_without <- lm(y ~ x,data=d[-i,])
full_fitted <- predict(fit,newdata=d)
without_fitted <- predict(fit_without,newdata=d)
cook_refit <- sum((full_fitted-without_fitted)^2)/(p*mse)
print(c(n=n,p=p,error_df=df.residual(fit),MSE=mse,h=h[i],e=e[i],
        Cook_formula=cook_formula,Cook_R=cook_r,Cook_refit=cook_refit),digits=12)
print(rbind(full=coef(fit),without_case_6=coef(fit_without)),digits=12)
print(data.frame(d,residual=e,h=h,Cook=cooks.distance(fit)),digits=10)
stopifnot(n==6,p==2,df.residual(fit)==4,
          abs(mse-1006/95)<1e-12,abs(h[i]-33/38)<1e-12,
          abs(e[i]+44/19)<1e-12,
          abs(cook_formula-31944/2515)<1e-10,
          abs(cook_formula-cook_r)<1e-10,
          abs(cook_formula-cook_refit)<1e-10,
          which.max(abs(e))==5,which.max(cooks.distance(fit))==6)
# These incorrect substitutions are diagnostic feedback, not alternative definitions.
wrong <- c(omitting_p=e[i]^2*h[i]/(mse*(1-h[i])^2),
           only_one_one_minus_h=e[i]^2*h[i]/(p*mse*(1-h[i])),
           using_error_df_for_p=e[i]^2*h[i]/(df.residual(fit)*mse*(1-h[i])^2),
           using_deleted_MSE=e[i]^2*h[i]/
             (p*(deviance(fit_without)/df.residual(fit_without))*(1-h[i])^2))
print(wrong,digits=12)
stopifnot(max(abs(wrong-c(25.4027833001988,1.67123574343413,
                          6.3506958250497,252.189473684211)))<1e-9)
# Deletion is a sensitivity calculation, not permission to discard a valid record.

