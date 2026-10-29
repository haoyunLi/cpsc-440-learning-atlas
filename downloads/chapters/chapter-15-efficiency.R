# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 15, section: efficiency
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original complete RCBD: three fixed treatments in four complete blocks.
d <- data.frame(treatment=factor(rep(c("A","B","C"),each=4)),
                block=factor(rep(1:4,3)),
                y=c(18,18,20,24,19,23,25,25,23,25,27,29))
with(d,table(treatment,block))
fit_block <- aov(y ~ treatment + block,data=d)
fit_ignore <- aov(y ~ treatment,data=d)
tab <- summary(fit_block)[[1]]
print(tab)
print(summary(fit_ignore))
t <- nlevels(d$treatment)
b <- nlevels(d$block)
error_df <- (t-1)*(b-1)
ignore_df <- t*(b-1)
mse <- deviance(fit_block)/error_df
ms_block <- tab["block","Mean Sq"]
ss_block <- tab["block","Sum Sq"]
ss_error <- deviance(fit_block)
# This ratio describes re-fitting the same observed data without a block term.
mse_refit <- (ss_block+ss_error)/ignore_df
ratio_refit <- mse_refit/mse
# The course planning formula estimates the CRD variance for replication planning.
mse_plan <- ((b-1)*ms_block+b*(t-1)*mse)/(b*t-1)
re_plan <- mse_plan/mse
continuous_reps <- b*re_plan
required_reps <- ceiling(continuous_reps)
print(c(RCBD_df=error_df,refit_CRD_df=ignore_df,MSE_RCBD=mse,
        MSE_refit=mse_refit,refit_ratio=ratio_refit,
        MSE_planning=mse_plan,planning_RE=re_plan,
        continuous_reps=continuous_reps,reps_per_treatment=required_reps))
# Compare SE proxies for the same treatment difference, with equal replication.
reps <- c(required_reps-1,required_reps)
print(data.frame(CRD_reps=reps,
                 SE_difference=sqrt(2*mse_plan/reps),
                 RCBD_SE_difference=sqrt(2*mse/b)))
stopifnot(df.residual(fit_ignore)==ignore_df,
          abs(deviance(fit_ignore)-(ss_block+ss_error))<1e-10,
          abs(ratio_refit-17/3)<1e-10,
          abs(re_plan-53/11)<1e-10,required_reps==20)
# Reproduce the course greenhouse calculation without rounding intermediate values.
course_t <- 3
course_b <- 5
course_mse <- 3.075
course_msb <- 57.375
course_refit <- ((course_b-1)*course_msb+
                (course_t-1)*(course_b-1)*course_mse)/
               (course_t*(course_b-1)*course_mse)
course_plan <- ((course_b-1)*course_msb+
               course_b*(course_t-1)*course_mse)/
              ((course_b*course_t-1)*course_mse)
print(c(greenhouse_refit_ratio=course_refit,
        greenhouse_planning_RE=course_plan,
        greenhouse_reps=ceiling(course_b*course_plan)))
