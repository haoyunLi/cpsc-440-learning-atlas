# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 11, section: leverage-influence
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Six original observations; x has one common measurement unit.
d <- data.frame(id=1:6,x=c(0,1,2,3,4,10),y=c(1,2,5,8,9,5))
fit <- lm(y ~ x,data=d)
n <- nrow(d)
p <- length(coef(fit))
error_df <- df.residual(fit)
fitted_full <- as.numeric(predict(fit,newdata=d))
e <- d$y-fitted_full
sse_full <- sum(e^2)
mse_full <- sse_full/error_df
sxx <- sum((d$x-mean(d$x))^2)
h_formula <- 1/n+(d$x-mean(d$x))^2/sxx
# p includes the intercept. This is ordinary, unweighted, full-rank OLS.
stopifnot(p==2,fit$rank==p,error_df==4,mse_full>0,
          all(h_formula<1),abs(sum(h_formula)-p)<1e-12)
D_formula <- (e^2/(p*mse_full))*h_formula/(1-h_formula)^2
# Verify the deletion definition directly for every observation.
# Rows are ALL six original x positions, including the omitted observation.
deleted_fits <- lapply(seq_len(n),function(i) lm(y ~ x,data=d[-i,]))
stopifnot(all(vapply(deleted_fits,function(m) m$rank==p,logical(1))))
pred_deleted <- vapply(deleted_fits,function(m)
  as.numeric(predict(m,newdata=d)),numeric(n))
# Each column is the deleted-fit prediction minus the full-fit prediction.
changed_fit <- sweep(pred_deleted,1,fitted_full,FUN="-")
D_deletion <- colSums(changed_fit^2)/(p*mse_full)
D_R <- as.numeric(cooks.distance(fit))
results <- data.frame(d,fitted=fitted_full,raw_residual=e,
                      leverage=h_formula,Cook_formula=D_formula,
                      Cook_deletion=D_deletion,Cook_R=D_R)
print(results,digits=12,row.names=FALSE)
stopifnot(max(abs(h_formula-hatvalues(fit)))<1e-12,
          max(abs(D_formula-D_R))<1e-10,
          max(abs(D_deletion-D_R))<1e-10)
# Compare the full fit with the explicitly documented omission of point 6.
omit6 <- deleted_fits[[6]]
summary_row <- function(m) c(n=nobs(m),intercept=unname(coef(m)[1]),
  slope=unname(coef(m)[2]),SSE=deviance(m),df=df.residual(m),
  MSE=deviance(m)/df.residual(m))
print(rbind(full=summary_row(fit),omit6=summary_row(omit6)),digits=12)
print(data.frame(x=d$x,y=d$y,full=fitted_full,omit6=pred_deleted[,6],
                 change=changed_fit[,6]),digits=12,row.names=FALSE)
print(c(sum_fitted_change_squared=sum(changed_fit[,6]^2),
        Cook_denominator=p*mse_full,D6=D_deletion[6]))
# The deleted-point residual can be much larger than its full-fit residual.
loo_residual <- d$y-diag(pred_deleted)
stopifnot(max(abs(loo_residual-e/(1-h_formula)))<1e-10,
          abs(loo_residual[6]+17.6)<1e-10,
          abs(sse_full-42.3578947368421)<1e-10,
          abs(D_R[6]-12.7013916500994)<1e-10)
# Put point 6 exactly on the line fitted to the first five observations.
on_line_data <- d
on_line_data$y[6] <- 22.6
on_line <- lm(y ~ x,data=on_line_data)
print(rbind(base_five=summary_row(omit6),on_line_six=summary_row(on_line)),
      digits=12)
print(rbind(base_five=summary(omit6)$coefficients[,"Std. Error"],
            on_line_six=summary(on_line)$coefficients[,"Std. Error"]),
      digits=12)
print(c(h6=hatvalues(on_line)[6],e6=residuals(on_line)[6],
        Cook6=cooks.distance(on_line)[6]))
stopifnot(max(abs(coef(on_line)-coef(omit6)))<1e-10,
          max(abs(hatvalues(on_line)-hatvalues(fit)))<1e-12,
          abs(cooks.distance(on_line)[6])<1e-20,
          abs(deviance(on_line)-1.6)<1e-10,
          abs(deviance(on_line)/df.residual(on_line)-.4)<1e-10)
# A change of x units alters the slope scale, not the fitted values or Cook's D.
unit_data <- d
unit_data$x <- 10*unit_data$x
unit_fit <- lm(y ~ x,data=unit_data)
stopifnot(abs(coef(unit_fit)[2]-coef(fit)[2]/10)<1e-12,
          max(abs(fitted(unit_fit)-fitted(fit)))<1e-10,
          max(abs(hatvalues(unit_fit)-hatvalues(fit)))<1e-12,
          max(abs(cooks.distance(unit_fit)-D_R))<1e-10)
# Large diagnostics prompt investigation and documented sensitivity analysis.
# They do not establish measurement error or justify automatic deletion.
