# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 07, section: chisquare
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Independent repetitions from five populations with theoretical variance 100.
RNGkind(kind="Mersenne-Twister",normal.kind="Inversion",sample.kind="Rejection")
set.seed(440701)
B <- 5000
alpha <- .05
null_variance <- 100
sample_sizes <- c(10,20,50)
generators <- list(
  Normal=function(m) rnorm(m,mean=0,sd=10),
  Uniform=function(m) runif(m,min=0,max=sqrt(1200)),
  Scaled_t5=function(m) 10*sqrt(3/5)*rt(m,df=5),
  Gamma_shape1=function(m) rgamma(m,shape=1,scale=10),
  Gamma_shape0.1=function(m) rgamma(m,shape=.1,scale=sqrt(100/.1))
)
# Check population variances analytically, not by forcing each sample variance.
theoretical_variance <- c(Normal=10^2,Uniform=(sqrt(1200))^2/12,
                          Scaled_t5=(10*sqrt(3/5))^2*5/(5-2),
                          Gamma_shape1=1*10^2,
                          Gamma_shape0.1=.1*(sqrt(100/.1))^2)
stopifnot(all(abs(theoretical_variance-null_variance)<1e-10))
rows <- list()
for (model in names(generators)) {
  for (n in sample_sizes) {
    # Each column is a fresh independent study with n observations.
    y <- matrix(generators[[model]](n*B),nrow=n,ncol=B)
    sample_variances <- apply(y,2,var)
    Q <- (n-1)*sample_variances/null_variance
    cutoffs <- qchisq(c(alpha,1-alpha),df=n-1)
    for (tail in c("right","left")) {
      rejected <- if (tail=="right") Q>cutoffs[2] else Q<cutoffs[1]
      rate <- mean(rejected)
      mcse <- sqrt(rate*(1-rate)/B)
      rows[[length(rows)+1]] <- data.frame(
        model=model,n=n,tail=tail,B=B,rejections=sum(rejected),
        rejection_rate=rate,MCSE=mcse,
        MC_lower=max(0,rate-qnorm(.975)*mcse),
        MC_upper=min(1,rate+qnorm(.975)*mcse))
    }
  }
}
result <- do.call(rbind,rows)
print(theoretical_variance)
print(result,row.names=FALSE,digits=6)
# These checks validate bookkeeping, not a theory from one random run.
stopifnot(all(result$rejections>=0),all(result$rejections<=B),
          all(result$MCSE>=0),all(is.finite(result$rejection_rate)))
