# Uniform density is a height, not a point probability.
print(c(density_at_04=dunif(.4),
        interval_probability=punif(.41)-punif(.4),
        zero_width_probability=punif(.4)-punif(.4)))
